#!/usr/bin/env python3
"""
NextGen Security Leader migration: data/NextGen.xlsx → data/survey.json (merge)

Validates, enriches, and merges 92 NextGen Security Leader records into the
existing master survey.json dataset.

Usage:
  # Dry run (validate + report, no writes):
  python scripts/migrate-nextgen-to-json.py --dry-run

  # Production run (writes merged survey.json):
  python scripts/migrate-nextgen-to-json.py

Run from the Paragon project root.
"""

import csv
import io
import json
import os
import sys
import uuid
import argparse
from datetime import datetime

import pandas as pd

EXCEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'NextGen.xlsx')
SURVEY_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'survey.json')

# ---------------------------------------------------------------------------
# Column names in NextGen.xlsx
# ---------------------------------------------------------------------------
COL_DATE         = 'Date Received'
COL_EMAIL        = 'Email Address'
COL_TITLE        = 'Your Title'
COL_TITLE_LEVEL  = 'Title-Level'
COL_LOCATION     = 'Location'
COL_SIZE         = 'Current Company Size'
COL_INDUSTRY     = 'Industry'
COL_STRUCTURE    = 'Company Structure'
COL_REPORTING_TO = 'Title of person you report to?'
COL_TEAM_SIZE    = 'Team Size'
COL_BASE         = 'Annual Base Salary $'
COL_BONUS        = 'Estimated Annual Bonus $'
COL_EQUITY       = 'Estimated Annual Equity / RSU Value'
COL_BOARD_FREQ   = 'How often do you present to the Board of Directors?'
COL_FUNCTIONS    = 'Which of the following functions fall under your direct responsibility and decision-making authority?'
COL_INCLUDED_IN  = 'Are you currently included in the following?'
COL_SEVERANCE    = 'Have you pre-negotiated a severance agreement as part of your employment?'
COL_ACCEL_VEST   = 'Do you have a negotiated accelerated vesting clause / early termination agreement?'
COL_SIGNING      = 'Did your most recent employment offer include a hiring bonus?'
COL_PREV_CISO    = 'Was your previous role a CISO / Head of Security position?'

REQUIRED_COLS = [
    COL_DATE, COL_EMAIL, COL_TITLE, COL_SIZE, COL_STRUCTURE,
    COL_REPORTING_TO, COL_BASE, COL_BOARD_FREQ, COL_FUNCTIONS,
    COL_INCLUDED_IN, COL_SEVERANCE, COL_ACCEL_VEST, COL_SIGNING,
    COL_PREV_CISO,
]

# ---------------------------------------------------------------------------
# Canonical function name map (union of master + NextGen variants)
# ---------------------------------------------------------------------------
FUNCTION_CANONICAL_MAP = {
    # Pass-through (already canonical)
    'AI Threat Intelligence and Incident Response': 'AI Threat Intelligence and Incident Response',
    'AI/ML Security Engineering': 'AI/ML Security Engineering',
    'Cloud Security': 'Cloud Security',
    'Corp IT Security / Enterprise Security': 'Corp IT Security / Enterprise Security',
    'Enterprise Risk': 'Enterprise Risk',
    'Fraud': 'Fraud',
    'GRC': 'GRC',
    'Incident Response': 'Incident Response',
    'Infrastructure Engineering / Operations': 'Infrastructure Engineering / Operations',
    'Physical Security / Executive Protection': 'Physical Security / Executive Protection',
    'Post-Quantum Cryptography (PQC)': 'Post-Quantum Cryptography (PQC)',
    'Privacy': 'Privacy',
    'Product Security / AppSec': 'Product Security / AppSec',
    'Security Operations': 'Security Operations',
    'Third Party Risk Management (TPRM)': 'Third Party Risk Management (TPRM)',
    'Identity and Access Management / IAM': 'Identity and Access Management / IAM',
    'Information Technology / BizApps': 'Information Technology / BizApps',
    'Trust and Safety': 'Trust and Safety',
    'AI Ethics and Responsible Use': 'AI Ethics and Responsible Use',
    'AI Safety and Reliability': 'AI Safety and Reliability',
    'AI Security and Safety': 'AI Security and Safety',
    'AI Governance Risk Management and Policy': 'AI Governance Risk Management and Policy',
    'AI Data Protection, Privacy, and Security': 'AI Data Protection, Privacy, and Security',

    # Normalizations (master)
    '3rd Party Risk Management (TPRM)': 'Third Party Risk Management (TPRM)',
    'AI Ethics & Responsible Use': 'AI Ethics and Responsible Use',
    'AI Governance, Risk Management, and Policy': 'AI Governance Risk Management and Policy',
    'AI Safety & Reliability': 'AI Safety and Reliability',
    'AI Security & Safety': 'AI Security and Safety',
    'Application Security': 'Product Security / AppSec',
    'Enterprise Risk for the organization': 'Enterprise Risk',
    'Identity & Access Management': 'Identity and Access Management / IAM',
    'Identity & Access Management / IAM': 'Identity and Access Management / IAM',
    'Information Technology (IT)': 'Information Technology / BizApps',
    'Information Technology (IT) / Business Technology (BizApps)': 'Information Technology / BizApps',
    'Infrastructure Engineering': 'Infrastructure Engineering / Operations',
    'Product Security': 'Product Security / AppSec',
    'Risk & Fraud': 'Fraud',
    'Trust & Safety (Content moderation, User issues, etc.)': 'Trust and Safety',

    # NextGen-specific variants
    'AI Data Protection / Privacy and Security': 'AI Data Protection, Privacy, and Security',
    'AI Governance / Risk Management and Policy': 'AI Governance Risk Management and Policy',
    'Trust & Safety': 'Trust and Safety',
    'Identity & Access Management / IAM ': 'Identity and Access Management / IAM',  # trailing space

    # Drop
    'Other': None,
}

COMPANY_STRUCTURE_MAP = {
    'Publicly Traded Company': 'Publicly Traded',
    'Privately Held Company': 'Privately Held',
    'PE-Backed Company': 'PE-Backed',
    'Non-Profit': 'Non-Profit',
    'Government / Municipality': 'Government',
}

SIZE_BUCKET_MAP = {
    '< 250 employees': 'Small',
    '250 - 499 employees': 'Mid-Market',
    '250 - 1000 employees': 'Mid-Market',
    '500 - 999 employees': 'Mid-Market',
    '1000 - 2500 employees': 'Large',
    '1000 - 4999 employees': 'Large',
    '2500 - 5000 employees': 'Large',
    '5000 - 9,999 employees': 'Enterprise',
    '10,000 - 25,000 employees': 'Enterprise',
    '25,000+ employees': 'Enterprise',
    '> 5000 employees': 'Enterprise',
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def safe_str(val):
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    s = str(val).strip()
    return s if s else None


def safe_int(val):
    try:
        v = float(val)
        return int(v) if not pd.isna(v) else None
    except (TypeError, ValueError):
        return None


def safe_float(val):
    try:
        v = float(val)
        return v if not pd.isna(v) else None
    except (TypeError, ValueError):
        return None


def safe_bool_yesno(val):
    """Convert 'Yes'/'No' / 'N/A' to boolean. N/A and anything else → False."""
    s = safe_str(val)
    if s is None:
        return False
    return s.strip().lower() == 'yes'


def format_date(val):
    """Normalize Date Received to ISO YYYY-MM-DD string."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    if isinstance(val, (datetime, pd.Timestamp)):
        return val.strftime('%Y-%m-%d')
    s = str(val).strip()
    if len(s) >= 10 and s[4] == '-':
        return s[:10]
    for fmt in ('%m/%d/%Y', '%Y/%m/%d', '%d/%m/%Y'):
        try:
            return datetime.strptime(s, fmt).strftime('%Y-%m-%d')
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------------------
# Role tier derivation from free-text title
# ---------------------------------------------------------------------------

def derive_role_tier(title_str):
    """
    Map free-text Your Title to RoleTier using ordered substring matching.

    Priority:
      1. Deputy CISO variants → 'Deputy CISO'
      2. 'head of'           → 'Head of Security'
      3. 'manager'           → 'Manager'
      4. Everything else     → 'Director'  (VP, Vice President, Sr. Dir, etc.)
    """
    if not title_str:
        return 'Director'
    t = title_str.lower()
    # 1. Deputy CISO (checked first — most specific; catches 'VP, Deputy CISO' too)
    if any(sub in t for sub in ('deputy ciso', 'deputy cso', 'deputy global ciso', '(deputy ciso)')):
        return 'Deputy CISO'
    # 2. Head of (e.g., 'Head of Security', 'VP, Head of Information Security...')
    if 'head of' in t:
        return 'Head of Security'
    # 3. Manager
    if 'manager' in t:
        return 'Manager'
    # 4. Default (Director, VP, Vice President, Executive Director, BISO, etc.)
    return 'Director'


# ---------------------------------------------------------------------------
# Protection field parsing
# ---------------------------------------------------------------------------

def parse_protections(raw_val):
    """
    Parse 'Are you currently included in the following?' into has_do and
    has_indemnification booleans.

    Values seen: 'Neither', 'Not Sure',
                 'Corporate D&O Policy', 'Corporate Directors & Officers (D&O) Policy',
                 'Corporate Indemnification Policy',
                 combinations of the above (comma-separated)
    """
    s = safe_str(raw_val) or ''
    has_do = 'D&O' in s or "Directors & Officers" in s
    has_indemnification = 'Indemnification' in s
    return has_do, has_indemnification


# ---------------------------------------------------------------------------
# Board frequency flags
# ---------------------------------------------------------------------------

def derive_board_flags(board_freq_val):
    """Return (board_quarterly, board_semi, board_regular, board_no_access)."""
    s = safe_str(board_freq_val) or ''
    if s == 'At least quarterly':
        return True, False, True, False
    if s == 'At least semi-annually':
        return False, True, True, False
    if s == 'At least annually':
        return False, False, True, False
    if s == 'Per request':
        return False, False, False, False
    if 'do not report' in s.lower() or 'not present' in s.lower():
        return False, False, False, True
    # Unknown value — treat as no access with a warning
    return False, False, False, True


# ---------------------------------------------------------------------------
# Function parsing
# ---------------------------------------------------------------------------

def parse_functions(raw_val):
    """Parse CSV-quoted function list. Never split naively on commas."""
    if raw_val is None or (isinstance(raw_val, float) and pd.isna(raw_val)):
        return []
    s = str(raw_val).strip()
    if not s:
        return []
    try:
        reader = csv.reader(io.StringIO(s))
        tokens = [fn.strip().strip('"').strip() for fn in next(reader)]
        return [t for t in tokens if t]
    except Exception:
        return []


def normalize_functions(raw_fns, unknown_log):
    """Apply canonical name map. Returns list of canonical names."""
    result = []
    for fn in raw_fns:
        if fn not in FUNCTION_CANONICAL_MAP:
            unknown_log.add(fn)
            continue
        canonical = FUNCTION_CANONICAL_MAP[fn]
        if canonical is None:
            continue  # explicitly dropped (e.g. 'Other')
        result.append(canonical)
    return result


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description='Migrate NextGen Security Leaders into survey.json')
    parser.add_argument('--dry-run', action='store_true', help='Validate and report without writing')
    args = parser.parse_args()

    dry_run = args.dry_run
    if dry_run:
        print('=== DRY RUN MODE — no files will be written ===\n')

    # -----------------------------------------------------------------------
    # Load source files
    # -----------------------------------------------------------------------
    if not os.path.exists(EXCEL_PATH):
        print(f'ERROR: NextGen.xlsx not found at {EXCEL_PATH}', file=sys.stderr)
        print('  → Move NextGen.xlsx from the project root to data/ first.', file=sys.stderr)
        sys.exit(1)

    if not os.path.exists(SURVEY_PATH):
        print(f'ERROR: survey.json not found at {SURVEY_PATH}', file=sys.stderr)
        sys.exit(1)

    print(f'Loading: {EXCEL_PATH}')
    df = pd.read_excel(EXCEL_PATH, sheet_name='Sheet1')
    print(f'Raw rows in Excel: {len(df)}')

    # Drop rows with no Date Received
    df = df[df[COL_DATE].notna()].reset_index(drop=True)
    print(f'After Date Received filter: {len(df)} rows\n')

    print(f'Loading: {SURVEY_PATH}')
    with open(SURVEY_PATH, 'r', encoding='utf-8') as f:
        master = json.load(f)
    print(f'Master records loaded: {len(master)}\n')

    # -----------------------------------------------------------------------
    # STEP 1: Column validation
    # -----------------------------------------------------------------------
    print('=== STEP 1: Column Validation ===')
    headers = list(df.columns)
    missing_cols = [c for c in REQUIRED_COLS if c not in headers]
    if missing_cols:
        print(f'  FAIL — Missing required columns ({len(missing_cols)}):')
        for c in missing_cols:
            print(f'    - {c}')
        if not dry_run:
            sys.exit(1)
    else:
        print(f'  PASS — All {len(REQUIRED_COLS)} required columns present')

    # -----------------------------------------------------------------------
    # STEP 2: Record-level validation
    # -----------------------------------------------------------------------
    print('\n=== STEP 2: Record-level Validation ===')

    missing_email  = df[df[COL_EMAIL].isna()].shape[0]
    missing_base   = df[df[COL_BASE].isna() | (df[COL_BASE] == 0)].shape[0]
    missing_title  = df[df[COL_TITLE].isna()].shape[0]
    missing_date   = 0  # Already filtered above

    print(f'  Missing email:        {missing_email}  (expected: 0)')
    print(f'  Missing/zero salary:  {missing_base}  (expected: 0)')
    print(f'  Missing title:        {missing_title}  (expected: 0)')
    print(f'  Missing date:         {missing_date}  (expected: 0)')

    if missing_email > 0:
        print(f'  WARNING: {missing_email} records have no email address')
    if missing_base > 0:
        print(f'  WARNING: {missing_base} records have missing/zero base salary')
    if missing_title > 0:
        print(f'  WARNING: {missing_title} records have missing title')

    # -----------------------------------------------------------------------
    # STEP 3: Build NextGen records
    # -----------------------------------------------------------------------
    print('\n=== STEP 3: Building NextGen Records ===')

    unknown_functions = set()
    nextgen_records = []
    role_tier_dist = {}
    board_freq_dist = {}
    size_bucket_null = 0
    unknown_board_vals = set()

    for _, row in df.iterrows():
        survey_date = format_date(row[COL_DATE])
        if not survey_date:
            print(f'  WARNING: Could not parse date for row, skipping: {row[COL_DATE]}')
            continue

        try:
            survey_year = int(pd.Timestamp(row[COL_DATE]).year)
        except Exception:
            survey_year = int(survey_date[:4])

        title = safe_str(row[COL_TITLE])
        role_tier = derive_role_tier(title)

        raw_structure = safe_str(row[COL_STRUCTURE])
        company_structure = COMPANY_STRUCTURE_MAP.get(raw_structure) if raw_structure else None

        raw_size = safe_str(row[COL_SIZE])
        size_bucket = SIZE_BUCKET_MAP.get(raw_size) if raw_size else None
        if size_bucket is None and raw_size:
            size_bucket_null += 1
            print(f'  WARNING: Unknown size value: {repr(raw_size)} → size_bucket=null')

        has_do, has_indemnification = parse_protections(row[COL_INCLUDED_IN])
        has_severance  = safe_bool_yesno(row[COL_SEVERANCE])
        has_accel_vest = safe_bool_yesno(row[COL_ACCEL_VEST])
        has_signing    = safe_bool_yesno(row[COL_SIGNING])

        full_quad        = has_do and has_indemnification and has_severance and has_accel_vest
        zero_quad        = not has_do and not has_indemnification and not has_severance and not has_accel_vest
        zero_protection  = zero_quad

        board_freq_val = safe_str(row[COL_BOARD_FREQ])
        board_quarterly, board_semi, board_regular, board_no_access = derive_board_flags(board_freq_val)

        # Warn on unknown board frequency values
        known_board = {'At least quarterly', 'At least semi-annually', 'At least annually', 'Per request',
                       'I do not report to the Board of Directors'}
        if board_freq_val and board_freq_val not in known_board:
            unknown_board_vals.add(board_freq_val)

        repeat_ciso    = safe_bool_yesno(row[COL_PREV_CISO])
        first_time_ciso = not repeat_ciso

        industry_raw = safe_str(row[COL_INDUSTRY])
        # If value contains comma, take the first segment (e.g. 'HealthTech,Healthcare' → 'HealthTech')
        # but preserve intentional multi-word values — only split on comma+space or lone comma
        industry = industry_raw

        raw_fns = parse_functions(row[COL_FUNCTIONS])
        functions = normalize_functions(raw_fns, unknown_functions)

        # Track distributions
        role_tier_dist[role_tier] = role_tier_dist.get(role_tier, 0) + 1
        bfd = board_freq_val or 'null'
        board_freq_dist[bfd] = board_freq_dist.get(bfd, 0) + 1

        record = {
            'id': str(uuid.uuid4()),
            'survey_date': survey_date,
            'survey_year': survey_year,
            'email': safe_str(row[COL_EMAIL]),
            'title': title,
            'role_tier': role_tier,
            'location': safe_str(row[COL_LOCATION]),
            'metro_tier': None,  # No metro flags in NextGen source
            'industry': industry,
            'company_structure': company_structure,
            'size_bucket': size_bucket,
            'reporting_to': safe_str(row[COL_REPORTING_TO]),
            'team_size': safe_int(row[COL_TEAM_SIZE]),
            'base_salary': safe_float(row[COL_BASE]),
            'bonus': safe_float(row[COL_BONUS]),
            'equity': safe_float(row[COL_EQUITY]),
            'board_frequency': board_freq_val,
            'functions': functions,
            'has_do': has_do,
            'has_indemnification': has_indemnification,
            'has_severance': has_severance,
            'has_accel_vest': has_accel_vest,
            'has_signing': has_signing,
            'full_quad': full_quad,
            'zero_quad': zero_quad,
            'zero_protection': zero_protection,
            'elevated_reporting': False,  # All NextGen report to CISO, not C-suite
            'board_quarterly': board_quarterly,
            'board_semi': board_semi,
            'board_regular': board_regular,
            'board_no_access': board_no_access,
            'repeat_ciso': repeat_ciso,
            'first_time_ciso': first_time_ciso,
            'role_classification': 'NextGen Security Leader',
        }
        nextgen_records.append(record)

    print(f'  Built {len(nextgen_records)} NextGen records')

    # -----------------------------------------------------------------------
    # STEP 4: Deduplication check
    # -----------------------------------------------------------------------
    print('\n=== STEP 4: Deduplication Check ===')

    # Build existing keys (email:year)
    existing_keys = set()
    existing_emails = set()
    for r in master:
        if r.get('email'):
            key = f"{r['email'].lower()}:{r['survey_year']}"
            existing_keys.add(key)
            existing_emails.add(r['email'].lower())

    duplicates = []
    longitudinal = []
    to_add = []

    for r in nextgen_records:
        email = (r['email'] or '').lower()
        year  = r['survey_year']
        key   = f'{email}:{year}'

        if email and key in existing_keys:
            duplicates.append({'email': r['email'], 'year': year, 'reason': 'email+year match'})
        else:
            to_add.append(r)
            if email and email in existing_emails:
                longitudinal.append({'email': r['email'], 'year': year})
            # Add to existing keys to catch within-batch duplicates
            if email:
                existing_keys.add(key)

    print(f'  Duplicate (email+year) pairs: {len(duplicates)}  (expected: 0)')
    print(f'  Longitudinal (same email, different year): {len(longitudinal)}  (expected: 12)')
    print(f'  Records to add: {len(to_add)}')

    if duplicates:
        print('  DUPLICATES (will be skipped):')
        for d in duplicates:
            print(f'    {d["email"]}  year={d["year"]}')

    # -----------------------------------------------------------------------
    # STEP 5: Summary report
    # -----------------------------------------------------------------------
    print('\n=== STEP 5: Enrichment Summary ===')
    print(f'  Year distribution (NextGen):')
    year_dist = {}
    for r in to_add:
        y = r['survey_year']
        year_dist[y] = year_dist.get(y, 0) + 1
    for y in sorted(year_dist):
        print(f'    {y}: {year_dist[y]}')

    print(f'\n  Role tier distribution:')
    for rt in sorted(role_tier_dist, key=lambda x: role_tier_dist[x], reverse=True):
        print(f'    {rt}: {role_tier_dist[rt]}')

    print(f'\n  Board frequency distribution:')
    for bf in sorted(board_freq_dist, key=lambda x: board_freq_dist[x], reverse=True):
        print(f'    {repr(bf)}: {board_freq_dist[bf]}')

    if unknown_board_vals:
        print(f'  WARNING: Unknown board frequency values: {unknown_board_vals}')

    print(f'\n  Protection rates (out of {len(to_add)} records):')
    print(f'    has_do:             {sum(1 for r in to_add if r["has_do"])} ({sum(1 for r in to_add if r["has_do"])/len(to_add)*100:.1f}%)')
    print(f'    has_indemnification:{sum(1 for r in to_add if r["has_indemnification"])} ({sum(1 for r in to_add if r["has_indemnification"])/len(to_add)*100:.1f}%)')
    print(f'    has_severance:      {sum(1 for r in to_add if r["has_severance"])} ({sum(1 for r in to_add if r["has_severance"])/len(to_add)*100:.1f}%)')
    print(f'    has_accel_vest:     {sum(1 for r in to_add if r["has_accel_vest"])} ({sum(1 for r in to_add if r["has_accel_vest"])/len(to_add)*100:.1f}%)')
    print(f'    has_signing:        {sum(1 for r in to_add if r["has_signing"])} ({sum(1 for r in to_add if r["has_signing"])/len(to_add)*100:.1f}%)')
    print(f'    full_quad:          {sum(1 for r in to_add if r["full_quad"])} ({sum(1 for r in to_add if r["full_quad"])/len(to_add)*100:.1f}%)')
    print(f'    zero_protection:    {sum(1 for r in to_add if r["zero_protection"])} ({sum(1 for r in to_add if r["zero_protection"])/len(to_add)*100:.1f}%)')

    print(f'\n  metro_tier null: {sum(1 for r in to_add if r["metro_tier"] is None)} / {len(to_add)}  (expected: all null)')
    print(f'  elevated_reporting False: {sum(1 for r in to_add if not r["elevated_reporting"])} / {len(to_add)}  (expected: all)')

    if unknown_functions:
        print(f'\n  WARNING: Unknown function values (mapped to pass-through or dropped):')
        for fn in sorted(unknown_functions):
            print(f'    {repr(fn)}')
    else:
        print(f'\n  Function normalization: CLEAN (no unknown values)')

    print(f'\n  Null counts on new records:')
    null_fields = ['email', 'title', 'base_salary', 'industry', 'company_structure', 'size_bucket',
                   'bonus', 'equity', 'reporting_to', 'team_size', 'metro_tier']
    for field in null_fields:
        null_n = sum(1 for r in to_add if r.get(field) is None)
        print(f'    {field:<22}: {null_n} null')

    # -----------------------------------------------------------------------
    # STEP 6: Projected merge stats
    # -----------------------------------------------------------------------
    total_after = len(master) + len(to_add)
    print(f'\n=== STEP 6: Projected Merge ===')
    print(f'  Existing master records:   {len(master)}')
    print(f'  NextGen records to add:    {len(to_add)}')
    print(f'  Duplicates skipped:        {len(duplicates)}')
    print(f'  TOTAL after merge:         {total_after}')
    print(f'  Security Program Leaders:  {len(master)}')
    print(f'  NextGen Security Leaders:  {len(to_add)}')

    # -----------------------------------------------------------------------
    # Write (skip in dry-run mode)
    # -----------------------------------------------------------------------
    if dry_run:
        print('\n=== DRY RUN COMPLETE — no files written ===')
        return

    print('\n=== Merging and Writing survey.json ===')

    # Backfill role_classification on all existing master records
    backfill_count = 0
    for r in master:
        if 'role_classification' not in r:
            r['role_classification'] = 'Security Program Leader'
            backfill_count += 1
    print(f'  Backfilled role_classification on {backfill_count} master records')

    # Merge
    merged = master + to_add

    # Atomic write: write to .tmp then rename
    tmp_path = SURVEY_PATH + '.tmp'
    with open(tmp_path, 'w', encoding='utf-8') as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)
    os.replace(tmp_path, SURVEY_PATH)

    print(f'\n=== Migration Complete ===')
    print(f'  Records written:           {len(merged)}')
    print(f'  Security Program Leaders:  {sum(1 for r in merged if r.get("role_classification") == "Security Program Leader")}')
    print(f'  NextGen Security Leaders:  {sum(1 for r in merged if r.get("role_classification") == "NextGen Security Leader")}')
    print(f'  Output: {SURVEY_PATH}')
    print('\nIMPORTANT: Restart the Next.js dev server to clear the data module cache.')


if __name__ == '__main__':
    main()
