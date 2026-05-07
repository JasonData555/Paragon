#!/usr/bin/env python3
"""
One-time migration: CISO_Protection_Analysis_Final.xlsx → data/survey.json

Run from the Paragon project root:
  /Users/jasonowens/Desktop/MarginWatch/margin-watch/.venv/bin/python scripts/migrate-excel-to-json.py
"""

import csv
import io
import json
import os
import sys
import uuid
from datetime import datetime

import pandas as pd

EXCEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'CISO_Protection_Analysis_Final.xlsx')
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'survey.json')

# ---------------------------------------------------------------------------
# Canonical function names (spec UI labels)
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

    # Normalizations
    '3rd Party Risk Management (TPRM)': 'Third Party Risk Management (TPRM)',
    'AI Ethics & Responsible Use': 'AI Ethics and Responsible Use',
    'AI Governance, Risk Management, and Policy': 'AI Governance Risk Management and Policy',
    'AI Safety & Reliability': 'AI Safety and Reliability',
    'AI Security & Safety': 'AI Security and Safety',
    'Application Security': 'Product Security / AppSec',
    'Enterprise Risk for the organization': 'Enterprise Risk',
    'Identity & Access Management': 'Identity and Access Management / IAM',
    'Identity & Access Management / IAM': 'Identity and Access Management / IAM',
    'Identity and Access Management / IAM': 'Identity and Access Management / IAM',
    'Information Technology (IT)': 'Information Technology / BizApps',
    'Information Technology (IT) / Business Technology (BizApps)': 'Information Technology / BizApps',
    'Infrastructure Engineering': 'Infrastructure Engineering / Operations',
    'Product Security': 'Product Security / AppSec',
    'Risk & Fraud': 'Fraud',
    'Trust & Safety (Content moderation, User issues, etc.)': 'Trust and Safety',

    # Non-spec function — keep in JSON but excluded from FSS UI
    'AI Data Protection, Privacy, and Security': 'AI Data Protection, Privacy, and Security',

    # Drop
    'Other': None,
}

COMPANY_STRUCTURE_MAP = {
    'Publicly Traded Company': 'Publicly Traded',
    'Privately Held Company': 'Privately Held',
    'Non-Profit': 'Non-Profit',
    'Government / Municipality': 'Government',
}

ROLE_TIER_MAP = {
    'CISO / Head Security Level': 'CISO',
    'VP Security': 'VP Security',
    'Director': 'Director',
    'Manager': 'Manager',
}

SIZE_BUCKET_MAP = {
    'Small': 'Small',
    'Mid-Market': 'Mid-Market',
    'Large': 'Large',
    'Enterprise': 'Enterprise',
}


def parse_functions(raw_val):
    """Parse CSV-quoted function list. Never split naively on commas."""
    if pd.isna(raw_val) or str(raw_val).strip() == '':
        return []
    try:
        reader = csv.reader(io.StringIO(str(raw_val)))
        tokens = [fn.strip().strip('"').strip() for fn in next(reader)]
        return [t for t in tokens if t]
    except Exception:
        return []


def normalize_functions(raw_fns):
    """Apply canonical name map. Returns list of canonical names (drops 'Other' and unknowns with a warning)."""
    result = []
    unknown = []
    for fn in raw_fns:
        if fn not in FUNCTION_CANONICAL_MAP:
            unknown.append(fn)
            continue
        canonical = FUNCTION_CANONICAL_MAP[fn]
        if canonical is None:
            continue  # explicitly dropped (e.g. 'Other')
        result.append(canonical)
    if unknown:
        print(f'  WARNING: Unknown function values: {unknown}', file=sys.stderr)
    return result


def derive_metro_tier(row):
    """Collapse tier1-tier6 flags into T1/T2/T3."""
    if row.get('tier1', 0) == 1 or row.get('tier2', 0) == 1:
        return 'T1'
    if row.get('tier3', 0) == 1 or row.get('tier4', 0) == 1:
        return 'T2'
    if row.get('tier5', 0) == 1 or row.get('tier6', 0) == 1:
        return 'T3'
    return None


def clean_industry(row):
    """Use 'What industry?' when populated; fall back to first segment of 'Company Industry'."""
    clean = row.get('What industry?')
    if not pd.isna(clean) and str(clean).strip():
        return str(clean).strip()
    raw = row.get('Company Industry')
    if not pd.isna(raw) and str(raw).strip():
        # Take first comma-separated value
        return str(raw).split(',')[0].strip()
    return None


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


def safe_str(val):
    if pd.isna(val):
        return None
    s = str(val).strip()
    return s if s else None


def safe_bool(val):
    try:
        v = float(val)
        return bool(int(v))
    except (TypeError, ValueError):
        return False


def format_date(val):
    """Normalize _date field to ISO 8601 date string."""
    if pd.isna(val):
        return None
    s = str(val).strip()
    # Already ISO format
    if len(s) >= 10 and s[4] == '-':
        return s[:10]
    # Try parsing other formats
    for fmt in ('%m/%d/%Y', '%Y/%m/%d', '%d/%m/%Y'):
        try:
            return datetime.strptime(s, fmt).strftime('%Y-%m-%d')
        except ValueError:
            continue
    return s


def main():
    print(f'Loading Excel: {EXCEL_PATH}')
    df = pd.read_excel(EXCEL_PATH, sheet_name='Clean Data', header=2)
    print(f'Raw rows: {len(df)}')

    # Drop empty trailing rows
    df = df[df['_date'].notna()].reset_index(drop=True)
    print(f'After _date filter: {len(df)} records')

    records = []
    unknown_functions_global = set()
    metro_null_count = 0

    for _, row in df.iterrows():
        # Parse and normalize functions
        raw_fns = parse_functions(row.get('Which of the following functions do you currently own for your company?'))
        fns = normalize_functions(raw_fns)

        # Metro tier
        metro = derive_metro_tier(row)
        if metro is None:
            metro_null_count += 1

        # Company structure
        raw_structure = safe_str(row.get('Company Structure'))
        structure = COMPANY_STRUCTURE_MAP.get(raw_structure) if raw_structure else None

        # Role tier
        raw_role = safe_str(row.get('Title-Level'))
        role_tier = ROLE_TIER_MAP.get(raw_role, 'CISO')

        # _date as ISO string
        survey_date = format_date(row.get('_date'))

        # _year as int
        survey_year = safe_int(row.get('_year'))

        # Size bucket (already correct values in dataset)
        raw_size = safe_str(row.get('Size_Bucket'))
        size_bucket = SIZE_BUCKET_MAP.get(raw_size) if raw_size else None

        record = {
            'id': str(uuid.uuid4()),
            'survey_date': survey_date,
            'survey_year': survey_year,
            'email': safe_str(row.get('Email Address')),
            'title': safe_str(row.get('Your Title')),
            'role_tier': role_tier,
            'location': safe_str(row.get('Location')),
            'metro_tier': metro,
            'industry': clean_industry(row),
            'company_structure': structure,
            'size_bucket': size_bucket,
            'reporting_to': safe_str(row.get('What is the title of person you report to?')),
            'team_size': safe_int(row.get('Team Size')),
            'base_salary': safe_float(row.get('Annual Base Salary $')),
            'bonus': safe_float(row.get('Estimated Annual Bonus $')),
            'equity': safe_float(row.get('Estimated Annual Equity / RSU Value')),
            'board_frequency': safe_str(row.get('How often do you present to the Board of Directors?')),
            'functions': fns,
            'has_do': safe_bool(row.get('has_do')),
            'has_indemnification': safe_bool(row.get('has_indemnification')),
            'has_severance': safe_bool(row.get('has_severance')),
            'has_accel_vest': safe_bool(row.get('has_accel_vest')),
            'has_signing': safe_bool(row.get('has_signing')),
            'full_quad': safe_bool(row.get('full_quad')),
            'zero_quad': safe_bool(row.get('zero_quad')),
            'zero_protection': safe_bool(row.get('zero_protection')),
            'elevated_reporting': safe_bool(row.get('elevated_reporting')),
            'board_quarterly': safe_bool(row.get('board_quarterly')),
            'board_semi': safe_bool(row.get('board_semi')),
            'board_regular': safe_bool(row.get('board_regular')),
            'board_no_access': safe_bool(row.get('board_no_access')),
            'repeat_ciso': safe_bool(row.get('repeat_ciso')),
            'first_time_ciso': safe_bool(row.get('first_time_ciso')),
        }
        records.append(record)

    # Write output
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(records, f, indent=2, ensure_ascii=False)

    # Summary
    print(f'\n=== Migration Summary ===')
    print(f'Records written: {len(records)}')
    print(f'Metro tier nulls: {metro_null_count}')
    print(f'Null emails: {sum(1 for r in records if r["email"] is None)}')
    print(f'Null base_salary: {sum(1 for r in records if r["base_salary"] is None)}')
    print(f'Records with functions: {sum(1 for r in records if len(r["functions"]) > 0)}')
    print(f'Avg function count: {sum(len(r["functions"]) for r in records) / len(records):.1f}')
    print(f'has_do rate: {sum(1 for r in records if r["has_do"]) / len(records) * 100:.1f}%')
    print(f'full_quad rate: {sum(1 for r in records if r["full_quad"]) / len(records) * 100:.1f}%')
    print(f'zero_protection rate: {sum(1 for r in records if r["zero_protection"]) / len(records) * 100:.1f}%')
    years = {}
    for r in records:
        y = r['survey_year']
        years[y] = years.get(y, 0) + 1
    print(f'Year distribution: {dict(sorted(years.items()))}')
    print(f'\nOutput: {OUTPUT_PATH}')
    print('Done.')


if __name__ == '__main__':
    main()
