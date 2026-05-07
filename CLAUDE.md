# Paragon — Claude Working Guide

## What This Is

Paragon is a proprietary compensation and governance intelligence platform built on a survey dataset owned by **Hitch Partners**. It is used live by Brett Starr and Michael Piacente in client calls (PE partners, CHROs) to generate branded intelligence briefs in seconds.

**Two operating modes:**
- **Intake** (`/intake`) — calibrate comp expectations before a search begins
- **Offer** (`/offer`) — position a specific candidate package against the peer distribution

**Admin is Jason only** — Brett and Michael have no admin access.

---

## Dev Environment

```bash
npm run dev        # starts on :3000 (kills stale processes first if needed)
npm run build      # type-check + production build
npx tsc --noEmit   # type-check only
```

Local: `http://localhost:3000`
Admin password: `Paragon2025!` (bcrypt hash in `.env.local`)

**Critical `.env.local` rule:** bcrypt hashes contain `$` signs that must be escaped as `\$` or dotenv-expand will silently corrupt the value (variables starting with letters get expanded to empty string). Always write:
```
ADMIN_PASSWORD_HASH=\$2b\$12\$...
```

After editing `.env.local`, Next.js hot-reloads it — but if webpack cache is corrupt, delete `.next/` and restart.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14, App Router |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 3.4 with `paragon-*` tokens |
| Fonts | Inter (sans, `--font-inter`), JetBrains Mono (mono, `--font-jetbrains-mono`) |
| PDF | `@react-pdf/renderer` |
| Auth | bcrypt + httpOnly session cookie (8hr TTL) |
| Data | `data/survey.json` (master dataset, ~943 records) |
| Audit | `data/audit.json` (append-only) |
| Deploy | Vercel |

**State management:** Prop-drilling only. State lives at page level, flows down. No Redux, no Context.

---

## App Structure

```
app/
  layout.tsx                    Root layout — Inter + JetBrains Mono font vars on <html>
  (app)/
    layout.tsx                  App shell — Sidebar (64px fixed) + <main> flex-1 ml-16
    dashboard/page.tsx          Server component — needs own max-w-6xl container
    coverage/page.tsx           Server component — needs own max-w-6xl container
    intake/page.tsx             Client — two-column fixed layout (480px left + flex-1 right)
    offer/page.tsx              Client — same structure as intake, mode="offer"
  admin/
    page.tsx                    Login page (unprotected)
    dashboard/page.tsx          Dataset overview (protected)
    upload/page.tsx             4-step upload wizard (protected)
    manage/page.tsx             Browse/delete records (protected)
    audit/page.tsx              Immutable audit log (protected)
  api/
    query/route.ts              Main query endpoint (POST)
    export/route.ts             PDF export
    config/route.ts             Industries list for dropdown
    admin/login/route.ts        bcrypt verify → set cookie
    admin/logout/route.ts
    admin/upload/route.ts       File ingestion, validation, merge
    admin/records/route.ts      GET filtered list, DELETE bulk
    admin/audit/route.ts        GET audit log

components/
  shared/
    QueryForm.tsx               Left column — form with sticky CTA footer
    FunctionSelector.tsx        Collapsible multi-select with ScopeStabilityGauge
    ScopeStabilityGauge.tsx     FSS zone-colored gauge (replaces old progress bar)
    RightColumnTabs.tsx         Three-tab right column (Overview/Compensation/Governance)
    CompDistributionCard.tsx    Compensation tab — box plot + dual sub-row table
    ComparisonBoxPlot.tsx       SVG box plot (benchmark vs profile, offer needle)
    GovernanceDeltaPanel.tsx    Governance tab — toggle rows WITH/WITHOUT/PREMIUM
    GovernanceDisplay.tsx       Deprecated — kept, not rendered
    CompBandDisplay.tsx         Deprecated — kept, not rendered
    Sidebar.tsx                 64px fixed nav (5 icons, hover tooltips)
    OrgDisplay.tsx              Org structure card
    FSSCard.tsx                 FSS intelligence card
    StatementDisplay.tsx        Calibration/competitive statement
    ConfidenceIndicator.tsx     HIGH/MEDIUM/LOW/INSUFFICIENT chip
    ExportButton.tsx            PDF export trigger
  ui/
    PillToggle.tsx, SearchableDropdown.tsx, CurrencyInput.tsx
    Badge.tsx, Modal.tsx, Skeleton.tsx, Tooltip.tsx
  admin/
    UploadStepper.tsx, RecordTable.tsx, AuditLog.tsx

lib/
  types.ts                      All TypeScript interfaces (source of truth)
  constants.ts                  Thresholds, governance config, relax order
  query-engine.ts               Main query logic — filtering, percentiles, FSS, governance
  recency-weights.ts            Decay formula + weighted percentile algorithm
  data-loader.ts                survey.json loader + recency weight application
  data-store.ts                 Read/write/merge/delete on survey.json
  function-weights.ts           FSS weight tiers + calculateFSS()
  statement-generator.ts        Calibration + competitive statement text
  admin-auth.ts                 verifyPassword, session token, cookie helpers
  audit-logger.ts               Append-only audit log writer
  deduplication.ts              Email + year duplicate detection
```

---

## Design System

### Color Tokens (all via `paragon-*` Tailwind classes)

| Token | Hex | Use |
|---|---|---|
| `paragon-sidebar` | `#0F4A42` | Left nav background |
| `paragon-accent-primary` | `#0F6E56` | Buttons, CTAs, active states |
| `paragon-accent-hover` | `#1D9E75` | Hover on buttons |
| `paragon-accent-light` | `#5DCAA5` | Secondary indicators |
| `paragon-mint-chip` | `#E1F5EE` | Badge/tag backgrounds, selected pills |
| `paragon-surface-primary` | `#F5F0E8` | Page background (warm linen) |
| `paragon-surface-card` | `#FFFFFF` | Card backgrounds |
| `paragon-border` | `#D3D1C7` | Card borders, dividers |
| `paragon-border-dark` | `#B4B2A9` | Emphasized borders |
| `paragon-text-primary` | `#2C2C2A` | Body text, stat numbers |
| `paragon-text-secondary` | `#5F5E5A` | Labels, captions |
| `paragon-text-muted` | `#888780` | Placeholders, disabled |
| `paragon-danger` | `#DC2626` | Below P25, LOW confidence |
| `paragon-warning` | `#F59E0B` | Candidate marker, MEDIUM confidence |
| `paragon-success` | `#059669` | Above P50, HIGH confidence |

### Typography Rules
- **Inter** for all narrative, labels, UI text (`font-sans`)
- **JetBrains Mono** for ALL data values — N counts, dollar amounts, percentages, FSS scores, axis labels (`font-mono`)
- Headings: 500 weight only — never 600 or 700
- Section labels: `.label-caps` class (11px, `#5F5E5A`, 0.06em tracking)
- Cards: 12px radius (`rounded-card`), `shadow-card`, 150ms transitions

### Layout Pattern (intake/offer pages)
```
Page background: #F5F0E8
├── Left column (flex: 0 0 480px, overflow-y: auto)  — white card
│   └── QueryForm (sticky CTA footer at bottom)
└── Right column (flex: 1, overflow: hidden)          — white card
    └── RightColumnTabs (tab bar fixed, content scrolls)
```
Dashboard and coverage pages use `max-w-6xl mx-auto px-6 py-8` wrappers — they do NOT get the two-column layout. The `(app)/layout.tsx` has no container — pages own their own layout.

---

## Data Model

### Key Types (`lib/types.ts`)

```typescript
QueryResult {
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT'
  raw_n, weighted_n
  comp_bands: CompBands          // same as profile_comp (alias)
  benchmark_comp: CompBands      // all records, no filters
  profile_comp: CompBands        // filtered records
  benchmark_n, profile_n
  governance: GovernanceResult
  org_structure: OrgStructureResult
  fss: FSSResult | null          // null if no functions selected
  statement: string
  candidate: CandidatePosition | null  // offer mode only
  filters_applied: AppliedFilters
  query_params: QueryParams
}

CompBands { base, bonus, equity, total_cash, total_comp: PercentileBand }
PercentileBand { p10, p25, p50, p75, p90, sample_n }
```

---

## Query Engine Logic (`lib/query-engine.ts`)

### Filter Priority (highest → lowest)
`role_tier` → `industry` → `company_structure` → `size_bucket` → `metro_tier`

**Role tier is NEVER relaxed.** Progressive relaxation drops filters in reverse order until `weighted_n >= LOW threshold`.

### Recency Weighting
```
weight = 1 - (age_in_months / 24) * 0.4
```
- 0 months: weight 1.0 → 24 months: weight 0.6 → >24 months: excluded
- Applied before ALL percentile calculations (comp, governance rates, FSS peer distribution)
- Report both `raw_n` and `weighted_n` in every response

### Dual-Pass Comp Calculation
1. **benchmark_comp** — `calcCompBands(allWeighted)` — all records, no filters
2. **profile_comp** — `calcCompBands(filtered)` — matched records only

### Confidence Thresholds (from `constants.ts`)
- HIGH: weighted_n ≥ 30
- MEDIUM: weighted_n ≥ 15
- LOW: weighted_n ≥ 8
- INSUFFICIENT: < 8

---

## Functional Scope Scoring (FSS)

**Empirical basis:** n=922, function count vs TC: Pearson r=0.107, p=0.001. Non-linear — comp peaks at 10–13 functions, declines above 18.

### Weight Tiers
- **Tier 1 (1.5x):** Product Security/AppSec, Cloud Security, Fraud, Security Operations
- **Tier 2 (1.2x):** Corp IT Security, GRC, AI/ML Security Engineering, Incident Response, AI Threat Intel, IT/BizApps, PQC, IAM
- **Tier 3 (1.0x):** TPRM, Infrastructure, Physical Security, AI Safety, AI Security, Trust and Safety
- **Flagged Neutral (1.0x, not penalized):** Enterprise Risk, Privacy, AI Ethics, AI Governance Policy

### Scoring Rules
1. Sort selected functions by weight (highest first)
2. Functions 1–13: full weight
3. Functions 14+: 50% weight (diminishing returns cap)
4. Sum = FSS score

### FSS Labels
- **Narrow:** below peer P25
- **Standard:** P25–P75
- **Broad:** P75–P90
- **Expansive:** above P90

### Governance Data (the competitive moat)
Governance correlations (r=0.217–0.304) are 3–4× stronger than any function.

| Element | Prevalence | WITH TC P50 | WITHOUT TC P50 | Delta |
|---|---|---|---|---|
| Accel Vesting (Double Trigger) | 16% | $810K | $448K | +$362K |
| Pre-Negotiated Severance | 17% | $800K | $449K | +$351K |
| Corporate Indemnification | 22% | $658K | $447K | +$211K |
| D&O Coverage | 50% | $623K | $373K | +$250K |

Display order: Accel Vesting first, D&O last (rarest = strongest story).

**Full Quad** (all 4 present): 7.6% prevalence, $894K vs $460K median TC.
**Zero Protection** (none present): 33% prevalence, $337K vs $594K peers.

---

## Auth & Admin

- Route: `/admin` (login), `/admin/dashboard`, `/admin/upload`, `/admin/manage`, `/admin/audit`
- Middleware (`middleware.ts`) checks `paragon_admin_session` httpOnly cookie on all `/admin/*` except login
- Session: timestamp-based token, 8hr TTL — `rand:timestamp` format
- Failed logins logged to `data/audit.json`
- `ALLOW_WRITES=true` in `.env.local` enables upload/delete locally (not set in Vercel production)

### Deduplication (upload)
- Duplicate = same `email` + same `survey_year` → skip (existing preserved)
- Same email + different year = longitudinal → keep both

---

## Functions Field Warning

The functions field uses comma-separated quoted strings. `"AI Governance, Risk Management, and Policy"` contains internal commas. **Never split naively on commas** — always use proper quoted CSV parsing. This is already handled in `data-loader.ts`.

---

## Animations & Interactions

| Element | Animation |
|---|---|
| Output sections | `fade-in-up` — 200ms ease-out, translateY 8px |
| Skeleton cards | `skeleton-pulse` — 1.5s ease-in-out |
| Scope gauge fill | `300ms ease-out` on score change |
| Offer needle | Slides from left, 300ms cubic ease-out after 200ms delay |
| Stat numbers | Count-up 600ms on render |
| Button press | `scale(0.98)` |
| Card hover | `scale(1.01)` |
| Min loading time | 600ms (enforced in QueryForm) |

---

## Component Patterns

### RightColumnTabs
- `activeTab` resets to `'overview'` via `useEffect` on `result` identity change
- Tab badges: hidden on **active** tab, visible on **inactive** tabs after query
  - Overview: `HIGH`/`MED`/`LOW` confidence word
  - Compensation: `P50 $XXXk` from `profile_comp.total_comp.p50`
  - Governance: `[N] / 4` count of elements with `prevalence_pct > 50`
- Skeleton badges animate during `loading`

### GovernanceDeltaPanel
- All toggles OFF on mount
- Toggle is **purely visual** — values never change
- Prompt text disappears after first toggle interaction
- Toggle ON: `#F5F0E8` bg, `border-left: 3px solid #0F6E56`, 200ms transition

### ScopeStabilityGauge
- Tick mark at 13-function threshold (`#F59E0B`)
- Zone colors: Narrow=`#D3D1C7`, Standard=gradient, Broad=`#0F6E56`, Expansive=`#F59E0B`
- Peer median appears only after first query result

### ComparisonBoxPlot
- Two-tone split boxes — upper half (P50→P75) darker, lower half (P25→P50) lighter; color boundary IS the median (no separate median line)
- Layer 1 (benchmark): 30px wide — upper `#94A3B8`, lower `#CBD5E1`, whiskers `#64748B`
- Layer 2 (profile): 18px wide — upper `#0F6E56`, lower `#5DCAA5`, whiskers `#0F4A42`, rendered in front
- Whiskers at P10/P90 with horizontal cap marks
- Divergence callout below Total Comp when `|profile P50 - benchmark P50| > 15%`

### CompDistributionCard
- "Details ▼ / Hide Details ▲" toggle button below the box plot; percentile table is collapsed by default
- Card order in Compensation tab: FSS card (if functions selected) → Org Structure → Compensation Distribution

### QueryForm
- After first successful query, changing function selections auto-triggers a re-query (600ms debounce); no button click required

---

## Dataset Benchmarks (n=926 after outlier removal)

| Metric | P25 | P50 | P75 | P90 |
|---|---|---|---|---|
| Base Salary | $250K | $300K | $365K | $425K |
| Total Comp | $315K | $480K | $805K | $1,103K |

Size bucket medians:
- Small (<250): Base $275K, TC $377K (n=286)
- Mid-Market (250–999): Base $300K, TC $525K (n=351)
- Large (1K–4.9K): Base $330K, TC $540K (n=187)
- Enterprise (5K+): Base $350K, TC $668K (n=102)

Annual refresh expected Q3/Q4 2026.
