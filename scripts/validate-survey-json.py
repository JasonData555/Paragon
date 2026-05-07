#!/usr/bin/env python3
"""Validates data/survey.json against known expected values."""

import json
import os
import sys

JSON_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'survey.json')

SPEC_CANONICAL_FUNCTIONS = {
    'Product Security / AppSec', 'Cloud Security', 'AI/ML Security Engineering',
    'Incident Response', 'Identity and Access Management / IAM',
    'Post-Quantum Cryptography (PQC)', 'Infrastructure Engineering / Operations', 'Trust and Safety',
    'GRC', 'AI Threat Intelligence and Incident Response', 'Information Technology / BizApps',
    'Third Party Risk Management (TPRM)', 'AI Safety and Reliability', 'AI Security and Safety',
    'Enterprise Risk', 'Privacy', 'Security Operations', 'Fraud',
    'Corp IT Security / Enterprise Security', 'Physical Security / Executive Protection',
    'AI Ethics and Responsible Use', 'AI Governance Risk Management and Policy',
    # Non-spec but kept
    'AI Data Protection, Privacy, and Security',
}

def main():
    with open(JSON_PATH, 'r') as f:
        records = json.load(f)

    errors = []
    warnings = []

    # Record count
    if len(records) != 943:
        errors.append(f'Expected 943 records, got {len(records)}')
    else:
        print(f'✓ Record count: {len(records)}')

    # Required fields present on all records
    required = ['id', 'survey_date', 'survey_year', 'role_tier', 'base_salary',
                'functions', 'has_do', 'has_indemnification', 'has_severance', 'has_accel_vest']
    for field in required:
        missing = sum(1 for r in records if field not in r)
        if missing:
            errors.append(f'Field "{field}" missing in {missing} records')
        else:
            print(f'✓ Field present: {field}')

    # Metro tier non-null
    metro_nulls = sum(1 for r in records if r.get('metro_tier') is None)
    if metro_nulls > 0:
        errors.append(f'metro_tier is null in {metro_nulls} records (expected 0)')
    else:
        print(f'✓ metro_tier non-null on all records')

    # Base salary non-null
    salary_nulls = sum(1 for r in records if r.get('base_salary') is None)
    if salary_nulls > 5:
        warnings.append(f'base_salary null in {salary_nulls} records (expected ≤5)')
    else:
        print(f'✓ base_salary nulls: {salary_nulls}')

    # Functions: all values in canonical set
    unknown_fns = set()
    for r in records:
        for fn in r.get('functions', []):
            if fn not in SPEC_CANONICAL_FUNCTIONS:
                unknown_fns.add(fn)
    if unknown_fns:
        warnings.append(f'Unknown function values: {sorted(unknown_fns)}')
    else:
        print(f'✓ All function values canonical')

    # has_do rate ~50%
    do_rate = sum(1 for r in records if r.get('has_do')) / len(records) * 100
    if abs(do_rate - 50) > 5:
        errors.append(f'has_do rate {do_rate:.1f}% expected ~50%')
    else:
        print(f'✓ has_do rate: {do_rate:.1f}% (expected ~50%)')

    # zero_protection rate ~33%
    zp_rate = sum(1 for r in records if r.get('zero_protection')) / len(records) * 100
    if abs(zp_rate - 33) > 5:
        warnings.append(f'zero_protection rate {zp_rate:.1f}% expected ~33%')
    else:
        print(f'✓ zero_protection rate: {zp_rate:.1f}% (expected ~33%)')

    # full_trifecta rate ~7.7% (matches spec "7.6%")
    trifecta = sum(1 for r in records
                   if r.get('has_do') and r.get('has_severance') and r.get('has_accel_vest'))
    trifecta_rate = trifecta / len(records) * 100
    print(f'ℹ  full_trifecta (D&O+Sev+Accel, spec "7.6%"): {trifecta_rate:.1f}% (n={trifecta})')
    full_quad = sum(1 for r in records if r.get('full_quad'))
    print(f'ℹ  full_quad (all four elements): {full_quad/len(records)*100:.1f}% (n={full_quad})')

    # Spot-check year distribution
    years = {}
    for r in records:
        y = r.get('survey_year')
        years[y] = years.get(y, 0) + 1
    print(f'✓ Year distribution: {dict(sorted(years.items()))}')

    # Unique IDs
    ids = [r['id'] for r in records]
    if len(set(ids)) != len(ids):
        errors.append(f'Duplicate IDs found')
    else:
        print(f'✓ All IDs unique')

    # Report
    print()
    if errors:
        print(f'ERRORS ({len(errors)}):')
        for e in errors:
            print(f'  ✗ {e}')
    if warnings:
        print(f'WARNINGS ({len(warnings)}):')
        for w in warnings:
            print(f'  ⚠ {w}')
    if not errors and not warnings:
        print('All checks passed.')

    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
