// server-only — imported only via dynamic import in /api/export/route.ts
// NEVER import this file in any client component or page

import React from 'react';
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import type { QueryParams, QueryResult } from '@/lib/types';

// Register Inter font using @fontsource/inter woff files (woff2 triggers a fontkit encoding bug)
import path from 'path';
const FONT_400 = path.join(process.cwd(), 'node_modules/@fontsource/inter/files/inter-latin-400-normal.woff');
const FONT_500 = path.join(process.cwd(), 'node_modules/@fontsource/inter/files/inter-latin-500-normal.woff');
Font.register({
  family: 'Inter',
  fonts: [
    { src: FONT_400, fontWeight: 400 },
    { src: FONT_500, fontWeight: 500 },
  ],
});

const TEAL   = '#0F4A42';
const ACCENT = '#0F6E56';
const TEXT   = '#2C2C2A';
const TEXT2  = '#5F5E5A';
const MUTED  = '#888780';
const BORDER = '#D3D1C7';
const MINT   = '#E1F5EE';
const LINEN  = '#F5F0E8';
const SUCCESS= '#059669';
const WARN   = '#F59E0B';
const DANGER = '#DC2626';

const s = StyleSheet.create({
  page: { fontFamily: 'Inter', fontSize: 10, color: TEXT, backgroundColor: '#FFFFFF', paddingHorizontal: 40, paddingVertical: 36 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: TEAL },
  wordmark: { fontSize: 18, fontWeight: 500, color: TEAL },
  wordmarkSub: { fontSize: 9, color: TEXT2, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  metaText: { fontSize: 8, color: TEXT2 },
  sectionLabel: { fontSize: 8, fontWeight: 500, color: TEXT2, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  card: { borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 9, fontWeight: 500, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  statLarge: { fontSize: 22, fontWeight: 500, color: TEXT },
  statLabel: { fontSize: 8, color: TEXT2, marginTop: 2 },
  row: { flexDirection: 'row' },
  col2: { flex: 1, marginRight: 8 },
  col2Last: { flex: 1 },
  tableHeader: { flexDirection: 'row', backgroundColor: LINEN, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 4, marginBottom: 4 },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  tableCell: { flex: 1, fontSize: 9 },
  tableCellBold: { flex: 1, fontSize: 9, fontWeight: 500 },
  tealBorder: { borderLeftWidth: 4, borderLeftColor: ACCENT, paddingLeft: 10 },
  greenBorder: { borderLeftWidth: 4, borderLeftColor: SUCCESS, paddingLeft: 10 },
  warnBorder: { borderLeftWidth: 4, borderLeftColor: WARN, paddingLeft: 10 },
  dangerBorder: { borderLeftWidth: 4, borderLeftColor: DANGER, paddingLeft: 10 },
  statementText: { fontSize: 10, lineHeight: 1.6, color: TEXT },
  govGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  govCell: { width: '50%', padding: 8, borderWidth: 0.5, borderColor: BORDER },
  govPct: { fontSize: 18, fontWeight: 500, color: TEXT },
  govDelta: { fontSize: 9, color: TEXT2, marginTop: 2 },
  footnote: { fontSize: 7, color: MUTED, lineHeight: 1.5, marginTop: 16, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: BORDER },
  confidenceBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, alignSelf: 'flex-start' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  tag: { backgroundColor: MINT, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, fontSize: 8, color: TEAL },
});

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n: number): string {
  return `${Math.round(n)}%`;
}

interface PDFProps {
  result: QueryResult;
  params: QueryParams;
  recipientName: string;
  generatedDate: string;
}

export function ParagonPDFDocument({ result, params, recipientName, generatedDate }: PDFProps) {
  const dateStr = new Date(generatedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const { comp_bands, governance, org_structure, fss, candidate, confidence, raw_n, weighted_n, statement } = result;

  const borderStyle = (() => {
    if (params.mode === 'intake') return s.tealBorder;
    const pct = candidate?.total_comp_percentile ?? 50;
    if (pct >= 75) return s.greenBorder;
    if (pct >= 50) return s.tealBorder;
    if (pct >= 25) return s.warnBorder;
    return s.dangerBorder;
  })();

  const confidenceColor = confidence === 'HIGH' ? SUCCESS : confidence === 'MEDIUM' ? WARN : DANGER;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.wordmark}>Paragon</Text>
            <Text style={s.wordmarkSub}>Powered by Hitch Partners</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.metaText}>{dateStr}</Text>
            <Text style={s.metaText}>Prepared exclusively for {recipientName}</Text>
            <Text style={[s.metaText, { marginTop: 4 }]}>
              {params.mode === 'intake' ? 'Intake Calibration' : 'Offer Assessment'}
            </Text>
          </View>
        </View>

        {/* Confidence + Statement */}
        <View style={[s.card, { marginBottom: 16 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <Text style={s.cardTitle}>{params.mode === 'intake' ? 'Market Calibration' : 'Competitive Assessment'}</Text>
            <View style={[s.confidenceBadge, { backgroundColor: confidenceColor }]}>
              <Text style={{ fontSize: 8, color: '#fff', fontWeight: 500 }}>{confidence}  n={raw_n} (eff. {weighted_n})</Text>
            </View>
          </View>
          <View style={borderStyle}>
            <Text style={s.statementText}>{statement}</Text>
          </View>
        </View>

        {/* Comp Band Table */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Compensation Bands (Weighted Percentiles)</Text>
          <View style={s.tableHeader}>
            {['', 'P25', 'P50', 'P75', 'P90'].map(h => (
              <Text key={h} style={[s.tableCell, { fontWeight: 500, fontSize: 8 }]}>{h}</Text>
            ))}
          </View>
          {[
            { label: 'Base Salary', b: comp_bands.base },
            { label: 'Bonus', b: comp_bands.bonus },
            { label: 'Equity / RSU', b: comp_bands.equity },
            { label: 'Total Cash', b: comp_bands.total_cash },
            { label: 'Total Comp', b: comp_bands.total_comp },
          ].map(({ label, b }) => (
            <View key={label} style={s.tableRow}>
              <Text style={s.tableCellBold}>{label}</Text>
              <Text style={s.tableCell}>{fmt(b.p25)}</Text>
              <Text style={[s.tableCell, { fontWeight: 500 }]}>{fmt(b.p50)}</Text>
              <Text style={s.tableCell}>{fmt(b.p75)}</Text>
              <Text style={s.tableCell}>{fmt(b.p90)}</Text>
            </View>
          ))}
          {candidate && (
            <View style={[s.tableRow, { backgroundColor: '#FEF3C7', marginTop: 4 }]}>
              <Text style={[s.tableCellBold, { color: '#92400E' }]}>Candidate</Text>
              <Text style={s.tableCell}></Text>
              <Text style={[s.tableCell, { fontWeight: 500, color: '#92400E' }]}>{fmt(candidate.base_value)}</Text>
              <Text style={s.tableCell}>{candidate.base_percentile != null ? `${candidate.base_percentile}th pct` : ''}</Text>
              <Text style={s.tableCell}>{candidate.total_comp_percentile != null ? `TC: ${candidate.total_comp_percentile}th pct` : ''}</Text>
            </View>
          )}
        </View>

        {/* Governance + Org side by side */}
        <View style={s.row}>
          {/* Governance */}
          <View style={[s.card, s.col2]}>
            <Text style={s.cardTitle}>Governance Protection</Text>
            <View style={s.govGrid}>
              {governance.elements.map(el => (
                <View key={el.key} style={s.govCell}>
                  <Text style={s.govPct}>{fmtPct(el.prevalence_pct)}</Text>
                  <Text style={{ fontSize: 8, color: TEXT, fontWeight: 500, marginTop: 2 }}>{el.name}</Text>
                  <Text style={s.govDelta}>+{fmt(el.delta)} delta</Text>
                </View>
              ))}
            </View>
            {governance.full_trifecta_pct > 5 && (
              <View style={{ backgroundColor: MINT, padding: 6, borderRadius: 4, marginTop: 8 }}>
                <Text style={{ fontSize: 8, color: TEAL, fontWeight: 500 }}>
                  Top {fmtPct(governance.full_trifecta_pct)} — Full Protection Package
                </Text>
              </View>
            )}
            {governance.zero_protection_pct > 25 && (
              <View style={{ borderWidth: 1, borderColor: DANGER, padding: 6, borderRadius: 4, marginTop: 8 }}>
                <Text style={{ fontSize: 8, color: DANGER }}>
                  No protection elements — below protected peers
                </Text>
              </View>
            )}
          </View>

          {/* Org Structure */}
          <View style={[s.card, s.col2Last]}>
            <Text style={s.cardTitle}>Org Structure</Text>
            <Text style={{ fontSize: 10, fontWeight: 500 }}>
              Team: P50 {org_structure.team_size_p50}
            </Text>
            <Text style={s.statLabel}>P25: {org_structure.team_size_p25} — P75: {org_structure.team_size_p75}</Text>

            <Text style={[s.sectionLabel, { marginTop: 10 }]}>Top Reporting Lines</Text>
            {org_structure.top_reporting_lines.slice(0, 4).map(rl => (
              <View key={rl.title} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                <Text style={{ fontSize: 8, flex: 1 }}>{rl.title}</Text>
                <Text style={{ fontSize: 8, color: TEXT2 }}>{fmtPct(rl.pct)}</Text>
              </View>
            ))}

            <Text style={[s.sectionLabel, { marginTop: 10 }]}>Common Functions</Text>
            <View style={s.tagRow}>
              {org_structure.top_functions.slice(0, 6).map(fn => (
                <Text key={fn.name} style={s.tag}>{fn.name.split('/')[0].trim()}</Text>
              ))}
            </View>
          </View>
        </View>

        {/* FSS Card */}
        {fss && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Functional Scope Intelligence</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: 500, color: ACCENT, marginRight: 12 }}>{fss.label}</Text>
              <Text style={{ fontSize: 9, color: TEXT2 }}>{fss.peer_percentile}th percentile vs peers</Text>
            </View>
            <View style={s.row}>
              <View style={s.col2}>
                <Text style={[s.sectionLabel, { color: SUCCESS }]}>Tier 1 Owned</Text>
                {fss.tier1_owned.length > 0
                  ? fss.tier1_owned.map(fn => <Text key={fn} style={{ fontSize: 8, marginBottom: 2 }}>✓ {fn}</Text>)
                  : <Text style={{ fontSize: 8, color: MUTED }}>None</Text>}
              </View>
              <View style={s.col2Last}>
                <Text style={[s.sectionLabel, { color: WARN }]}>Tier 1 Missing</Text>
                {fss.tier1_missing.length > 0
                  ? fss.tier1_missing.map(fn => <Text key={fn} style={{ fontSize: 8, marginBottom: 2, color: '#92400E' }}>○ {fn}</Text>)
                  : <Text style={{ fontSize: 8, color: MUTED }}>None</Text>}
              </View>
            </View>
            <View style={{ backgroundColor: LINEN, padding: 8, borderRadius: 4, marginTop: 8 }}>
              <Text style={{ fontSize: 9, lineHeight: 1.5 }}>{fss.justification}</Text>
            </View>
          </View>
        )}

        {/* Methodology footnote */}
        <Text style={s.footnote}>
          Methodology: This analysis uses linear recency weighting. More recent data carries greater weight. Records approaching 24 months are discounted by up to 40% before automatic expiration. All percentiles are weighted percentiles using cumulative weight thresholds. Governance correlations are Pearson r values (n=922). Dataset: Hitch Partners CISO Compensation Survey 2024–2025. Paragon | Powered by Hitch Partners.
        </Text>
      </Page>
    </Document>
  );
}
