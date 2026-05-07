import { NextResponse } from 'next/server';
import { getUniqueIndustries } from '@/lib/data-loader';
import { COMPANY_STRUCTURE_OPTIONS, METRO_TIER_OPTIONS, ROLE_TIER_OPTIONS, SIZE_BUCKET_OPTIONS, METRO_TIER_LABELS } from '@/lib/constants';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const industries = getUniqueIndustries();
    return NextResponse.json({
      industries,
      role_tiers: ROLE_TIER_OPTIONS,
      company_structures: COMPANY_STRUCTURE_OPTIONS,
      size_buckets: SIZE_BUCKET_OPTIONS,
      metro_tiers: METRO_TIER_OPTIONS,
      metro_tier_labels: METRO_TIER_LABELS,
    });
  } catch (error) {
    console.error('[config] error:', error);
    return NextResponse.json({ error: 'Failed to load configuration' }, { status: 500 });
  }
}
